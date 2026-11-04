import { diffDays, type Day } from './days';
import type { Grade } from './scheduler';

/* ---------- F-24 weak topics ---------- */

/** A topic is weak if at least WEAK_MIN_FORGOTS of its last WEAK_WINDOW graded revisions were Forgot. */
export const WEAK_WINDOW = 5;
export const WEAK_MIN_FORGOTS = 2;

/** `grades` newest first. Returns how many Forgots are in the recent window and whether that makes it weak. */
export function weakness(grades: Grade[]): { recentForgots: number; recentGraded: number; weak: boolean } {
  const recent = grades.slice(0, WEAK_WINDOW);
  const recentForgots = recent.filter((g) => g === 'FORGOT').length;
  return { recentForgots, recentGraded: recent.length, weak: recentForgots >= WEAK_MIN_FORGOTS };
}

/* ---------- F-25 target & pace ---------- */

export type PaceStatus = 'ahead' | 'on_track' | 'behind' | 'done' | 'overdue';

export interface Pace {
  target: number;
  targetDate: Day;
  startDay: Day;
  completed: number;
  /** Completed topics expected by today on a straight line from (startDay, baseline) to (targetDate, target). */
  expected: number;
  status: PaceStatus;
  /** Topics per day still needed to hit the target, counting today; null once done or overdue. */
  perDayNeeded: number | null;
  daysLeft: number;
}

export function computePace(o: {
  target: number;
  targetDate: Day;
  startDay: Day;
  baseline: number;
  completed: number;
  today: Day;
}): Pace {
  const total = Math.max(1, diffDays(o.targetDate, o.startDay));
  const elapsed = Math.min(total, Math.max(0, diffDays(o.today, o.startDay)));
  const expected = o.baseline + ((o.target - o.baseline) * elapsed) / total;
  const daysLeft = diffDays(o.targetDate, o.today);
  const remaining = o.target - o.completed;

  let status: PaceStatus;
  if (remaining <= 0) status = 'done';
  else if (daysLeft < 0) status = 'overdue';
  else {
    // One topic of slack either way counts as on track.
    const diff = o.completed - expected;
    status = diff >= 1 ? 'ahead' : diff <= -1 ? 'behind' : 'on_track';
  }
  const perDayNeeded = status === 'done' || status === 'overdue' ? null : remaining / (daysLeft + 1);
  return {
    target: o.target,
    targetDate: o.targetDate,
    startDay: o.startDay,
    completed: o.completed,
    expected: Math.round(expected * 10) / 10,
    status,
    perDayNeeded: perDayNeeded === null ? null : Math.round(perDayNeeded * 10) / 10,
    daysLeft,
  };
}
