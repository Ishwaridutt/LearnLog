import { useQuery } from '@tanstack/react-query';
import type { Day, TimelineLive } from '@study/shared';
import { api } from '../../api/client';

/** Refetch while something is ticking so totals and new sessions stay current. */
const LIVE_REFETCH_MS = 60_000;

export function useTimeline(from: Day | undefined, to: Day | undefined) {
  return useQuery({
    queryKey: ['timeline', from, to],
    queryFn: () => api.timeline(from!, to!),
    enabled: !!from && !!to,
    placeholderData: (prev) => prev,
    refetchInterval: (q) => (q.state.data?.live ? LIVE_REFETCH_MS : false),
  });
}

/** One day's detail; no day means today (the server decides, honouring the day-start hour). */
export function useDay(day?: Day) {
  return useQuery({
    queryKey: ['day', day ?? 'today'],
    queryFn: () => api.day(day),
    placeholderData: (prev) => prev,
    refetchInterval: (q) => (q.state.data?.live ? LIVE_REFETCH_MS : false),
  });
}

/** Seconds ticked since the server computed `asOf`, while something is running. */
export function liveExtra(asOf: string, live: TimelineLive | null, now: number): number {
  return live ? Math.max(0, (now - Date.parse(asOf)) / 1000) : 0;
}

/** Hatched fill for "Focus (no topic)" so it never looks like a subject colour. */
export const FOCUS_FILL = 'repeating-linear-gradient(135deg, var(--color-slate-400) 0 3px, var(--color-slate-200) 3px 6px)';
export const FOCUS_LABEL = 'Focus (no topic)';

const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const dayNumFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const wdFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

const asDate = (day: Day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const fmtLongDay = (day: Day) => weekdayFmt.format(asDate(day));
export const fmtShortDay = (day: Day) => shortFmt.format(asDate(day));
export const fmtDayNum = (day: Day) => dayNumFmt.format(asDate(day));
export const fmtWeekday = (day: Day) => wdFmt.format(asDate(day));

/** "1h 05m", "42m", or "<1m" for a few seconds so a tiny session never reads as nothing. */
export function fmtSpent(seconds: number): string {
  if (seconds > 0 && seconds < 60) return '<1m';
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
