import type { Pace, PaceStatus } from '@study/shared';
import { fmtDay } from '../lib/format';
import { Badge } from './ui';

/** Labels are deliberately calm: "behind" should prompt a small adjustment, not guilt. */
export const PACE_META: Record<PaceStatus, { label: string; tone: 'green' | 'sky' | 'amber' | 'violet' | 'red' }> = {
  ahead: { label: 'Ahead', tone: 'green' },
  on_track: { label: 'On track', tone: 'sky' },
  behind: { label: 'Behind', tone: 'amber' },
  done: { label: 'Target reached', tone: 'violet' },
  overdue: { label: 'Past target date', tone: 'red' },
};

export function PaceBadge({ pace }: { pace: Pace }) {
  const m = PACE_META[pace.status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/** F-25: progress bar with a marker where you'd be on a straight-line plan. */
export function PaceCard({ pace }: { pace: Pace }) {
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / pace.target) * 100))}%`;
  const gap = Math.abs(Math.round((pace.completed - pace.expected) * 10) / 10);
  const topics = (n: number) => `${n} ${n === 1 ? 'topic' : 'topics'}`;
  const perDay = `${pace.perDayNeeded} ${pace.perDayNeeded === 1 ? 'topic' : 'topics'} a day`;
  const message =
    pace.status === 'done'
      ? `You've completed ${pace.completed} of ${pace.target}. Set a new target any time from Edit.`
      : pace.status === 'overdue'
        ? `The target date passed with ${topics(pace.target - pace.completed)} to go. Pick a new date from Edit; it re-plans from today.`
        : pace.status === 'behind'
          ? `About ${topics(gap)} behind plan. ${perDay} from here gets you there.`
          : pace.status === 'ahead'
            ? `${topics(gap)} ahead of plan. ${perDay} keeps you on course.`
            : `Right on plan. ${perDay} gets you there.`;

  return (
    <div className="rounded-xl border border-slate-200 bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Target:</span> {pace.target} topics by {fmtDay(pace.targetDate)}
          {pace.daysLeft >= 0 && pace.status !== 'done' && (
            <span className="text-slate-500"> · {pace.daysLeft === 0 ? 'due today' : `${pace.daysLeft} days left`}</span>
          )}
        </p>
        <PaceBadge pace={pace} />
      </div>
      <div className="relative mt-3 h-2.5 rounded-full bg-slate-100" role="img" aria-label={`${pace.completed} of ${pace.target} completed, ${pace.expected} expected by today`}>
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: pct(pace.completed) }} />
        {pace.status !== 'done' && (
          <span
            className="absolute -top-1 h-4.5 w-0.5 rounded bg-slate-500"
            style={{ left: pct(pace.expected) }}
            title={`Plan for today: ${pace.expected}`}
          />
        )}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
        <span>
          <strong className="text-slate-800">{pace.completed}</strong> / {pace.target} completed · plan for today {pace.expected}
        </span>
        <span>{message}</span>
      </div>
    </div>
  );
}
