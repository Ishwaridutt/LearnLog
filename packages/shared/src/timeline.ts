import { z } from 'zod';
import type { Day } from './days';
import { diffDays } from './days';

/** F-38: daily study timeline. Ranges are capped so a request stays cheap. */
export const TIMELINE_MAX_DAYS = 400;

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const timelineQuerySchema = z
  .object({ from: dayString.optional(), to: dayString.optional() })
  .refine((q) => !q.from || !q.to || (q.from <= q.to && diffDays(q.to, q.from) < TIMELINE_MAX_DAYS), {
    message: `from must be on or before to, and the range at most ${TIMELINE_MAX_DAYS} days`,
  });
export type TimelineQuery = z.infer<typeof timelineQuerySchema>;

export const dayParamSchema = dayString;

/** A subject as it appears in a timeline legend. */
export interface TimelineSubject {
  fieldId: string;
  name: string;
  color: string;
  /** Seconds in the whole range. */
  seconds: number;
}

export interface TimelineDay {
  day: Day;
  /** Everything counted that day: topic time plus focus countdowns with no topic. */
  seconds: number;
  /** Topic time per subject, largest first. */
  subjects: { fieldId: string; seconds: number }[];
  /** Focus countdowns not linked to a topic (breaks never count). */
  focusSeconds: number;
}

/**
 * What is ticking right now, so the client can keep totals live between fetches:
 * add (now − asOf) to today's total and to this subject (or to focusSeconds when fieldId is null).
 */
export interface TimelineLive {
  fieldId: string | null;
}

export interface Timeline {
  from: Day;
  to: Day;
  today: Day;
  asOf: string;
  live: TimelineLive | null;
  subjects: TimelineSubject[];
  days: TimelineDay[];
}

/** Gap under which consecutive stretches of the same topic and kind show as one session. */
export const SESSION_MERGE_GAP_SECONDS = 5 * 60;

export type DaySessionKind = 'LEARNING' | 'REVISION' | 'FOCUS';

/** One stretch of study on a day; spans that cross the day boundary are clipped to the day. */
export interface DaySession {
  id: string;
  kind: DaySessionKind;
  startedAt: string;
  /** null while it is still running. */
  endedAt: string | null;
  seconds: number;
  /** Back-to-back stretches of the same topic and kind (pause → resume) are merged into one row. */
  parts: number;
  topicId: string | null;
  topicName: string | null;
  fieldId: string | null;
  fieldName: string | null;
  color: string | null;
}

export interface DayTopic {
  topicId: string;
  name: string;
  seconds: number;
  learningSeconds: number;
  revisionSeconds: number;
}

export interface DaySubject {
  fieldId: string;
  name: string;
  color: string;
  seconds: number;
  topics: DayTopic[];
}

export interface DayDetail {
  day: Day;
  today: Day;
  asOf: string;
  live: TimelineLive | null;
  seconds: number;
  focusSeconds: number;
  subjects: DaySubject[];
  sessions: DaySession[];
}

type FocusTiming = {
  status: string;
  usedSeconds: number;
  plannedSeconds: number;
  runningSince: Date | string | null;
  startedAt: Date | string;
  endedAt: Date | string | null;
};

const ms = (d: Date | string) => (typeof d === 'string' ? Date.parse(d) : d.getTime());

/**
 * The wall-clock span a focus countdown's used time is placed on. Sessions keep total used time, not
 * each running stretch, so used time is laid out back from the end: exact for a session that was never
 * paused, and close otherwise. A running session ends now (or at its countdown end, if that passed).
 */
export function focusSpan(s: FocusTiming, now: Date | number): { start: Date; end: Date } | null {
  const t = typeof now === 'number' ? now : now.getTime();
  const begin = ms(s.startedAt);
  let end: number;
  let used = s.usedSeconds;
  if (s.endedAt) end = ms(s.endedAt);
  else if (s.runningSince) {
    const since = ms(s.runningSince);
    const countdownEnd = since + Math.max(0, s.plannedSeconds - s.usedSeconds) * 1000;
    end = Math.min(t, countdownEnd);
    used += Math.max(0, (end - since) / 1000);
  } else end = begin + used * 1000; // paused: assume it ran from the start
  const start = Math.max(begin, end - used * 1000);
  return end > start ? { start: new Date(start), end: new Date(end) } : null;
}
