import { Injectable } from '@nestjs/common';
import {
  addDays,
  CalendarDay,
  computeStreaks,
  DayDetail,
  DaySession,
  DaySessionKind,
  DaySubject,
  dayRange,
  focusSpan,
  SESSION_MERGE_GAP_SECONDS,
  splitByStudyDay,
  StreakInfo,
  studyDay,
  Timeline,
  TimelineDay,
  TimelineLive,
} from '@study/shared';
import { TimerService } from '../activities/timer.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../profile/settings.service';

type Interval = { start: number; end: number };

/** A stretch of counted study time, before it is split into days. */
interface Span {
  id: string;
  kind: DaySessionKind;
  parts: Interval[];
  running: boolean;
  topicId: string | null;
  topicName: string | null;
  fieldId: string | null;
  fieldName: string | null;
  color: string | null;
}

/** `a` minus every interval in `cuts`. */
function subtract(a: Interval, cuts: Interval[]): Interval[] {
  let out = [a];
  for (const c of cuts) {
    if (c.end <= a.start || c.start >= a.end) continue;
    out = out.flatMap((p) => {
      if (c.end <= p.start || c.start >= p.end) return [p];
      const keep: Interval[] = [];
      if (c.start > p.start) keep.push({ start: p.start, end: c.start });
      if (c.end < p.end) keep.push({ start: c.end, end: p.end });
      return keep;
    });
  }
  return out;
}

/** Local start of a study day and of the next one. */
function dayBounds(day: string, dayStartHour: number): Interval {
  const [y, m, d] = day.split('-').map(Number);
  return { start: new Date(y, m - 1, d, dayStartHour).getTime(), end: new Date(y, m - 1, d + 1, dayStartHour).getTime() };
}

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly timer: TimerService,
  ) {}

  /**
   * F-38: every counted stretch overlapping study days `from`..`to`. Topic time comes from timer segments
   * (linked focus sessions already write those). Focus countdowns with no topic count too, minus any time a
   * topic timer was also running, so nothing is counted twice. Breaks never count.
   */
  private async spans(from: string, to: string, now: Date, dayStartHour: number): Promise<Span[]> {
    await this.timer.settle();
    const windowStart = new Date(dayBounds(from, dayStartHour).start);
    const windowEnd = new Date(dayBounds(to, dayStartHour).end);
    const overlap = { startedAt: { lt: windowEnd }, OR: [{ endedAt: null }, { endedAt: { gt: windowStart } }] };
    const [segments, focus] = await Promise.all([
      this.prisma.timeSegment.findMany({
        where: overlap,
        orderBy: { startedAt: 'asc' },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          activity: { select: { type: true, topic: { select: { id: true, name: true, field: { select: { id: true, name: true, color: true } } } } } },
        },
      }),
      this.prisma.focusSession.findMany({ where: { ...overlap, kind: 'FOCUS', topicId: null }, orderBy: { startedAt: 'asc' } }),
    ]);

    const t = now.getTime();
    const topicSpans: Span[] = segments.map((seg) => {
      const topic = seg.activity.topic;
      return {
        id: seg.id,
        kind: seg.activity.type === 'REVISION' ? 'REVISION' : 'LEARNING',
        parts: [{ start: seg.startedAt.getTime(), end: seg.endedAt?.getTime() ?? t }],
        running: !seg.endedAt,
        topicId: topic.id,
        topicName: topic.name,
        fieldId: topic.field.id,
        fieldName: topic.field.name,
        color: topic.field.color,
      };
    });
    const topicTime = topicSpans.map((sp) => sp.parts[0]);
    const focusSpans: Span[] = focus.flatMap((f) => {
      const span = focusSpan(f, now);
      if (!span) return [];
      const running = f.status === 'RUNNING' && span.end.getTime() >= t;
      const parts = subtract({ start: span.start.getTime(), end: span.end.getTime() }, topicTime);
      return [{ id: f.id, kind: 'FOCUS' as const, parts, running, topicId: null, topicName: null, fieldId: null, fieldName: null, color: null }];
    });
    return [...topicSpans, ...focusSpans];
  }

  /** What is ticking right now: an open topic segment wins over an unlinked countdown running alongside it. */
  private live(spans: Span[]): TimelineLive | null {
    const topic = spans.find((sp) => sp.running && sp.kind !== 'FOCUS');
    if (topic) return { fieldId: topic.fieldId };
    return spans.some((sp) => sp.running) ? { fieldId: null } : null;
  }

  /** F-38: seconds per study day, split by subject, for a bar chart. Defaults to the last 30 days. */
  async timeline(from?: string, to?: string): Promise<Timeline> {
    const s = await this.settings.get();
    const now = new Date();
    const today = studyDay(now, s.dayStartHour);
    const end = to ?? today;
    const start = from ?? addDays(end, -29);
    const spans = await this.spans(start, end, now, s.dayStartHour);

    const days = new Map<string, { focus: number; byField: Map<string, number> }>(
      dayRange(start, end).map((d) => [d, { focus: 0, byField: new Map() }]),
    );
    const subjects = new Map<string, { fieldId: string; name: string; color: string; seconds: number }>();
    for (const sp of spans) {
      for (const p of sp.parts) {
        for (const part of splitByStudyDay(new Date(p.start), new Date(p.end), s.dayStartHour)) {
          const entry = days.get(part.day);
          if (!entry) continue;
          if (!sp.fieldId) {
            entry.focus += part.seconds;
            continue;
          }
          entry.byField.set(sp.fieldId, (entry.byField.get(sp.fieldId) ?? 0) + part.seconds);
          const subj = subjects.get(sp.fieldId) ?? { fieldId: sp.fieldId, name: sp.fieldName!, color: sp.color!, seconds: 0 };
          subj.seconds += part.seconds;
          subjects.set(sp.fieldId, subj);
        }
      }
    }

    const out: TimelineDay[] = [...days].map(([day, e]) => {
      const bySubject = [...e.byField].map(([fieldId, secs]) => ({ fieldId, seconds: Math.round(secs) })).sort((a, b) => b.seconds - a.seconds);
      const focusSeconds = Math.round(e.focus);
      return { day, seconds: bySubject.reduce((n, x) => n + x.seconds, 0) + focusSeconds, subjects: bySubject, focusSeconds };
    });
    return {
      from: start,
      to: end,
      today,
      asOf: now.toISOString(),
      live: end >= today ? this.live(spans) : null,
      subjects: [...subjects.values()].map((x) => ({ ...x, seconds: Math.round(x.seconds) })).sort((a, b) => b.seconds - a.seconds),
      days: out,
    };
  }

  /** F-38: one study day in detail: subject → topic totals and a list of sessions. Defaults to today. */
  async day(day?: string): Promise<DayDetail> {
    const s = await this.settings.get();
    const now = new Date();
    const today = studyDay(now, s.dayStartHour);
    const target = day ?? today;
    const bounds = dayBounds(target, s.dayStartHour);
    const spans = await this.spans(target, target, now, s.dayStartHour);

    const subjects = new Map<string, DaySubject>();
    const sessions: DaySession[] = [];
    let focusSeconds = 0;
    for (const sp of spans) {
      const inDay = sp.parts
        .map((p) => ({ start: Math.max(p.start, bounds.start), end: Math.min(p.end, bounds.end) }))
        .filter((p) => p.end > p.start);
      const secs = inDay.reduce((n, p) => n + (p.end - p.start) / 1000, 0);
      // Skip empty slivers, but never the running stretch: it is what makes the day live, even in its first second.
      if (secs < 1 && !sp.running) continue;
      const first = Math.min(...inDay.map((p) => p.start));
      const last = Math.max(...inDay.map((p) => p.end));
      sessions.push({
        id: sp.id,
        kind: sp.kind,
        startedAt: new Date(first).toISOString(),
        endedAt: sp.running && last >= now.getTime() - 1000 ? null : new Date(last).toISOString(),
        seconds: secs,
        parts: 1,
        topicId: sp.topicId,
        topicName: sp.topicName,
        fieldId: sp.fieldId,
        fieldName: sp.fieldName,
        color: sp.color,
      });
      if (!sp.fieldId) {
        focusSeconds += secs;
        continue;
      }
      const subj = subjects.get(sp.fieldId) ?? { fieldId: sp.fieldId, name: sp.fieldName!, color: sp.color!, seconds: 0, topics: [] };
      subj.seconds += secs;
      let topic = subj.topics.find((x) => x.topicId === sp.topicId);
      if (!topic) {
        topic = { topicId: sp.topicId!, name: sp.topicName!, seconds: 0, learningSeconds: 0, revisionSeconds: 0 };
        subj.topics.push(topic);
      }
      topic.seconds += secs;
      if (sp.kind === 'REVISION') topic.revisionSeconds += secs;
      else topic.learningSeconds += secs;
      subjects.set(sp.fieldId, subj);
    }

    const r = Math.round;
    const list = [...subjects.values()]
      .map((x) => ({
        ...x,
        seconds: r(x.seconds),
        topics: x.topics
          .map((tp) => ({ ...tp, seconds: r(tp.seconds), learningSeconds: r(tp.learningSeconds), revisionSeconds: r(tp.revisionSeconds) }))
          .sort((a, b) => b.seconds - a.seconds),
      }))
      .sort((a, b) => b.seconds - a.seconds);
    sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const daySpans = spans.filter((sp) => sessions.some((x) => x.id === sp.id));
    // Pausing and resuming leaves many short pieces; show back-to-back pieces of the same topic and kind as one row.
    const merged: DaySession[] = [];
    for (const x of sessions) {
      const prev = merged[merged.length - 1];
      const gap = prev?.endedAt ? (Date.parse(x.startedAt) - Date.parse(prev.endedAt)) / 1000 : Infinity;
      if (prev && prev.kind === x.kind && prev.topicId === x.topicId && gap <= SESSION_MERGE_GAP_SECONDS) {
        prev.endedAt = x.endedAt;
        prev.seconds += x.seconds;
        prev.parts += x.parts;
      } else merged.push({ ...x });
    }
    return {
      day: target,
      today,
      asOf: now.toISOString(),
      live: target === today ? this.live(daySpans) : null,
      seconds: list.reduce((n, x) => n + x.seconds, 0) + r(focusSeconds),
      focusSeconds: r(focusSeconds),
      subjects: list,
      sessions: merged.map((x) => ({ ...x, seconds: r(x.seconds) })),
    };
  }

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

  /** §6.10: minutes and completions per study day. Sessions are split at day boundaries; minutes count like the timeline. */
  async calendar(from?: string, to?: string): Promise<CalendarDay[]> {
    const s = await this.settings.get();
    const now = new Date();
    const end = to ?? studyDay(now, s.dayStartHour);
    const start = from ?? addDays(end, -370);

    const days = new Map<string, CalendarDay>(
      dayRange(start, end).map((day) => [day, { day, minutes: 0, learnings: 0, revisions: 0 }]),
    );

    // Same counting as the timeline (F-38), so the heatmap and the Timeline page always agree.
    const [spans, activities] = await Promise.all([
      this.spans(start, end, now, s.dayStartHour),
      this.prisma.activity.findMany({
        where: { status: 'COMPLETED', completedDay: { gte: start, lte: end } },
        select: { completedDay: true, type: true },
      }),
    ]);

    // Midnight fix: a session crossing the day boundary counts on each day it touches.
    const seconds = new Map<string, number>();
    for (const sp of spans) {
      for (const p of sp.parts) {
        for (const part of splitByStudyDay(new Date(p.start), new Date(p.end), s.dayStartHour)) {
          seconds.set(part.day, (seconds.get(part.day) ?? 0) + part.seconds);
        }
      }
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
