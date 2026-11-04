import { Injectable } from '@nestjs/common';
import { DEFAULT_INTERVALS, Settings, SettingsInput, studyDay } from '@study/shared';
import { PrismaService, Tx } from '../prisma/prisma.service';

/** Parse a stored JSON ladder; null if absent or invalid. */
export function parseIntervals(json: string | null): number[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) && v.length && v.every((n) => Number.isInteger(n) && n > 0) ? v : null;
  } catch {
    return null;
  }
}

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

  /** F-26: the revision ladder for a field: its own if set, otherwise the global one. */
  async intervalsFor(fieldId: string, tx: Tx = this.prisma): Promise<number[]> {
    const field = await tx.studyField.findUnique({ where: { id: fieldId }, select: { revisionIntervals: true } });
    const custom = parseIntervals(field?.revisionIntervals ?? null);
    return custom ?? (await this.get(tx)).revisionIntervals;
  }

  /** Today's study day under current settings. */
  async today(tx: Tx = this.prisma): Promise<string> {
    const s = await this.get(tx);
    return studyDay(new Date(), s.dayStartHour);
  }
}
