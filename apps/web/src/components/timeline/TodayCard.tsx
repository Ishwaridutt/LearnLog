import { Link } from 'react-router-dom';
import { addDays } from '@study/shared';
import { useLiveDayTotals } from './DayDetailPanel';
import { SplitBar, Swatch } from './SplitBar';
import { fmtSpent, useDay, useTimeline } from './useTimeline';

/** F-38: dashboard card with today's study time (live), its split by subject and the 7-day average. */
export function TodayCard() {
  const today = useDay();
  const day = today.data?.day;
  const week = useTimeline(day && addDays(day, -7), day && addDays(day, -1));
  const live = useLiveDayTotals(today.data);
  if (!today.data) return null;

  const avg = week.data ? week.data.days.reduce((n, d) => n + d.seconds, 0) / 7 : null;
  const diff = avg === null ? null : live.seconds - avg;
  const top = live.parts.slice().sort((a, b) => b.seconds - a.seconds);

  return (
    <section className="rounded-2xl border border-slate-200 bg-surface p-5" aria-label="Studied today">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Studied today</p>
          <p className="flex items-center gap-2 text-3xl font-bold text-slate-900 tabular-nums">
            {fmtSpent(live.seconds)}
            {today.data.live && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" title="Timer running" />}
          </p>
          {avg !== null && diff !== null && (
            <p className="text-xs text-slate-500">
              {avg < 60 ? (
                'No study in the last 7 days'
              ) : (
                <>
                  <span className={`font-medium ${diff >= 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {diff >= 0 ? '▲' : '▼'} {fmtSpent(Math.abs(diff))}
                  </span>{' '}
                  vs 7-day average ({fmtSpent(avg)})
                </>
              )}
            </p>
          )}
        </div>

        <div className="min-w-[14rem] flex-1 self-center">
          {live.seconds < 1 ? (
            <p className="text-sm text-slate-500">Nothing yet today. Start a topic timer or a focus session and it shows up here.</p>
          ) : (
            <>
              <SplitBar parts={live.parts} className="h-3" />
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                {top.slice(0, 4).map((p) => (
                  <li key={p.key} className="flex min-w-0 items-center gap-1.5">
                    <Swatch color={p.color} />
                    <span className="max-w-[12rem] truncate">{p.label}</span>
                    <span className="text-slate-400 tabular-nums">{fmtSpent(p.seconds)}</span>
                  </li>
                ))}
                {top.length > 4 && <li className="text-slate-400">+{top.length - 4} more</li>}
              </ul>
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 self-center">
          <Link to={`/timeline?day=${today.data.day}`} className="rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
            Today's details →
          </Link>
          <Link to="/timeline" className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-indigo-50 hover:text-indigo-700">
            Full timeline
          </Link>
        </div>
      </div>
    </section>
  );
}
