import { addDays, Day } from './days';

export interface Streaks {
  current: number;
  longest: number;
  todayQualified: boolean;
}

/**
 * §6.8: a qualifying day has ≥1 completed activity. The current streak counts back
 * from today if today qualifies, otherwise from yesterday (today isn't over yet).
 */
export function computeStreaks(qualifyingDays: Iterable<Day>, today: Day): Streaks {
  const set = new Set(qualifyingDays);
  const sorted = [...set].sort();

  let longest = 0;
  let run = 0;
  let prev: Day | null = null;
  for (const day of sorted) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = day;
  }

  const todayQualified = set.has(today);
  let current = 0;
  let cursor = todayQualified ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, longest, todayQualified };
}

/** §6.10 heatmap shade: 0 | 1–29 | 30–89 | 90–179 | 180+ minutes. */
export function heatLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 90) return 2;
  if (minutes < 180) return 3;
  return 4;
}
