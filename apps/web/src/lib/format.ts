import { diffDays, type Day } from '@study/shared';

/** Seconds → "2h 05m" / "42m" / "0m". */
export function fmtDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** Seconds → "01:02:03". */
export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** Closed seconds plus the live running stretch. */
export function liveSeconds(total: number, liveSince: string | null, now: number): number {
  return total + (liveSince ? Math.max(0, (now - Date.parse(liveSince)) / 1000) : 0);
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');
export const fmtDateTime = (iso: string | null) => (iso ? dateTimeFmt.format(new Date(iso)) : '—');
export const fmtTime = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : '—');

/** A study day (YYYY-MM-DD) as "12 Nov 2026". */
export function fmtDay(day: Day | null): string {
  if (!day) return '—';
  const [y, m, d] = day.split('-').map(Number);
  return dateFmt.format(new Date(y, m - 1, d));
}

/** "today", "tomorrow", "in 3 days", "2 days ago". */
export function relDay(day: Day, today: Day): string {
  const n = diffDays(day, today);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** Value for <input type="datetime-local"> from a Date, in local time. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
