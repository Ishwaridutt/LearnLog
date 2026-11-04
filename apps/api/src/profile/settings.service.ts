import { Injectable } from '@nestjs/common';
import { DEFAULT_INTERVALS, Settings, SettingsInput, studyDay } from '@study/shared';
import { PrismaService, Tx } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tx: Tx = this.prisma): Promise<Settings> {
    const row = await tx.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    let intervals: number[] = DEFAULT_INTERVALS;
    try {
      const parsed = JSON.parse(row.revisionIntervals);
      if (Array.isArray(parsed) && parsed.length) intervals = parsed;
    } catch {
      /* fall back to defaults */
    }
    return {
      revisionIntervals: intervals,
      dayStartHour: row.dayStartHour,
      dailyRevisionCap: row.dailyRevisionCap,
      longSessionMinutes: row.longSessionMinutes,
      calendarView: row.calendarView === 'TICKS' ? 'TICKS' : 'HEATMAP',
    };
  }

  async update(input: SettingsInput): Promise<Settings> {
    await this.get();
    const { revisionIntervals, ...rest } = input;
    await this.prisma.settings.update({
      where: { id: 1 },
      data: { ...rest, ...(revisionIntervals ? { revisionIntervals: JSON.stringify(revisionIntervals) } : {}) },
    });
    return this.get();
  }

  /** Today's study day under current settings. */
  async today(tx: Tx = this.prisma): Promise<string> {
    const s = await this.get(tx);
    return studyDay(new Date(), s.dayStartHour);
  }
}
