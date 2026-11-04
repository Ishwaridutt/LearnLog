import { Injectable } from '@nestjs/common';
import { addDays, CalendarDay, computeStreaks, dayRange, StreakInfo, studyDay } from '@study/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../profile/settings.service';

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** §6.8 */
  async streak(): Promise<StreakInfo> {
    const today = await this.settings.today();
    const rows = await this.prisma.activity.findMany({
      where: { status: 'COMPLETED', completedDay: { not: null } },
      select: { completedDay: true },
      distinct: ['completedDay'],
    });
    return { today, ...computeStreaks(rows.map((r) => r.completedDay!), today) };
  }

  /** §6.10: minutes and completions per study day. Segments count toward their start day. */
  async calendar(from?: string, to?: string): Promise<CalendarDay[]> {
    const s = await this.settings.get();
    const now = new Date();
    const end = to ?? studyDay(now, s.dayStartHour);
    const start = from ?? addDays(end, -370);

    const days = new Map<string, CalendarDay>(
      dayRange(start, end).map((day) => [day, { day, minutes: 0, learnings: 0, revisions: 0 }]),
    );

    // Pad the query window by a day each side; exact filtering happens on study days.
    const windowStart = new Date(`${addDays(start, -1)}T00:00:00`);
    const windowEnd = new Date(`${addDays(end, 2)}T00:00:00`);
    const [segments, activities] = await Promise.all([
      this.prisma.timeSegment.findMany({
        where: { startedAt: { gte: windowStart, lt: windowEnd } },
        select: { startedAt: true, endedAt: true },
      }),
      this.prisma.activity.findMany({
        where: { status: 'COMPLETED', completedDay: { gte: start, lte: end } },
        select: { completedDay: true, type: true },
      }),
    ]);

    const seconds = new Map<string, number>();
    for (const seg of segments) {
      const d = studyDay(seg.startedAt, s.dayStartHour);
      const secs = ((seg.endedAt ?? now).getTime() - seg.startedAt.getTime()) / 1000;
      seconds.set(d, (seconds.get(d) ?? 0) + Math.max(0, secs));
    }
    for (const [d, secs] of seconds) {
      const entry = days.get(d);
      if (entry) entry.minutes = Math.round(secs / 60);
    }
    for (const a of activities) {
      const entry = days.get(a.completedDay!);
      if (!entry) continue;
      if (a.type === 'LEARNING') entry.learnings++;
      else entry.revisions++;
    }
    return [...days.values()];
  }
}
