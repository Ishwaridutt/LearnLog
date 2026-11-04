/** A study day as a calendar date string, `YYYY-MM-DD`. See REQUIREMENTS §6.1. */
export type Day = string;

const pad = (n: number) => String(n).padStart(2, '0');

function parseDay(day: Day): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [y, m, d];
}

function utcToDay(dt: Date): Day {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Local calendar date of a timestamp. */
export function localDay(ts: Date): Day {
  return `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}`;
}

/** Calendar date `day` plus `n` days (n may be negative). Timezone-free. */
export function addDays(day: Day, n: number): Day {
  const [y, m, d] = parseDay(day);
  return utcToDay(new Date(Date.UTC(y, m - 1, d + n)));
}

/** Whole days from `b` to `a` (a − b). */
export function diffDays(a: Day, b: Day): number {
  const [ay, am, ad] = parseDay(a);
  const [by, bm, bd] = parseDay(b);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

/** The study day a timestamp belongs to, honouring the day-start hour (0 = midnight). */
export function studyDay(ts: Date | string | number, dayStartHour = 0): Day {
  const t = new Date(ts);
  const base = localDay(t);
  return t.getHours() < dayStartHour ? addDays(base, -1) : base;
}

/** Day of week for a Day: 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(day: Day): number {
  const [y, m, d] = parseDay(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Inclusive list of days from `from` to `to`. */
export function dayRange(from: Day, to: Day): Day[] {
  const out: Day[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * Split a time span into seconds per study day, cutting at each day boundary
 * (local `dayStartHour`). Used so a session that runs past midnight counts on both days.
 */
export function splitByStudyDay(start: Date, end: Date, dayStartHour = 0): { day: Day; seconds: number }[] {
  const out: { day: Day; seconds: number }[] = [];
  let cur = start.getTime();
  const stop = end.getTime();
  while (cur < stop) {
    const day = studyDay(cur, dayStartHour);
    const [y, m, d] = parseDay(day);
    // Next boundary: the following calendar day at dayStartHour, local time (DST-safe).
    const boundary = new Date(y, m - 1, d + 1, dayStartHour).getTime();
    const next = Math.min(boundary, stop);
    out.push({ day, seconds: (next - cur) / 1000 });
    cur = next;
  }
  return out;
}
