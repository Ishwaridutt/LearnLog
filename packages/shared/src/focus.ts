import { z } from 'zod';

/** Countdown (pomodoro) timer: types, request schemas and the time maths both sides share. */

export const FOCUS_KINDS = ['FOCUS', 'BREAK'] as const;
export type FocusKind = (typeof FOCUS_KINDS)[number];

export const FOCUS_STATUSES = ['RUNNING', 'PAUSED', 'COMPLETED', 'STOPPED'] as const;
export type FocusStatus = (typeof FOCUS_STATUSES)[number];

export const FOCUS_MIN_SECONDS = 60;
export const FOCUS_MAX_SECONDS = 8 * 3600;

const plannedSeconds = z
  .number()
  .int()
  .min(FOCUS_MIN_SECONDS, 'Set at least 1 minute')
  .max(FOCUS_MAX_SECONDS, 'Set at most 8 hours');

export const focusStartSchema = z.object({
  kind: z.enum(FOCUS_KINDS),
  plannedSeconds,
  topicId: z.string().min(1).nullish(),
});
export type FocusStartInput = z.infer<typeof focusStartSchema>;

export const focusEditSchema = z.object({ plannedSeconds });
export type FocusEditInput = z.infer<typeof focusEditSchema>;

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const focusHistoryQuerySchema = z.object({
  kind: z.enum(FOCUS_KINDS).optional(),
  status: z.enum(FOCUS_STATUSES).optional(),
  from: dayString.optional(),
  to: dayString.optional(),
});
export type FocusHistoryQuery = z.infer<typeof focusHistoryQuerySchema>;

export interface FocusSession {
  id: string;
  kind: FocusKind;
  status: FocusStatus;
  plannedSeconds: number;
  /** Closed running time; add the live stretch since `runningSince` while RUNNING. */
  usedSeconds: number;
  runningSince: string | null;
  startedAt: string;
  endedAt: string | null;
  topicId: string | null;
  topicName: string | null;
  fieldId: string | null;
  fieldName: string | null;
}

export interface FocusCurrent {
  /** The RUNNING or PAUSED session, if any. */
  active: FocusSession | null;
  /** The most recently finished session (for the "time's up" prompt after a reload). */
  last: FocusSession | null;
}

export interface FocusTopicOption {
  id: string;
  name: string;
  status: string;
  fieldId: string;
  fieldName: string;
}

export interface FocusSound {
  /** Served path under /api/focus/sounds/. */
  file: string;
  name: string;
}

type Timing = { usedSeconds: number; runningSince: Date | string | null; plannedSeconds: number };

const ms = (d: Date | string) => (typeof d === 'string' ? Date.parse(d) : d.getTime());

/** Seconds used so far, including the live stretch. */
export function focusUsed(s: Timing, now: Date | number): number {
  const t = typeof now === 'number' ? now : now.getTime();
  const live = s.runningSince ? Math.max(0, (t - ms(s.runningSince)) / 1000) : 0;
  return s.usedSeconds + live;
}

/** Seconds left on the countdown, never below 0. */
export function focusRemaining(s: Timing, now: Date | number): number {
  return Math.max(0, s.plannedSeconds - focusUsed(s, now));
}

/** When a RUNNING session reaches 0, or null if it is paused. */
export function focusEndsAt(s: Timing): Date | null {
  if (!s.runningSince) return null;
  return new Date(ms(s.runningSince) + Math.max(0, s.plannedSeconds - s.usedSeconds) * 1000);
}
