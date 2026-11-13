import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { addDays, dayOfWeek, heatLevel, type CalendarDay, type CalendarView, type Day } from '@study/shared';
import { api } from '../api/client';
import { fmtDay } from '../lib/format';
import { Spinner } from './ui';

const HEAT = ['bg-[var(--heat-0)]', 'bg-[var(--heat-1)]', 'bg-[var(--heat-2)]', 'bg-[var(--heat-3)]', 'bg-[var(--heat-4)]'];

const tip = (d: CalendarDay) =>
  `${fmtDay(d.day)}: ${d.minutes} min · ${d.learnings} learned · ${d.revisions} revised · click for details`;

/** F-38: every past day opens that day on the Timeline page. */
const dayLink = (d: Day) => `/timeline?day=${d}`;

/** F-15: current/longest streak with a heatmap ⇄ month-ticks calendar. */
export function StreakCard() {
  const qc = useQueryClient();
  const streak = useQuery({ queryKey: ['streak'], queryFn: api.streak });
  const calendar = useQuery({ queryKey: ['calendar'], queryFn: api.calendar });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const setView = useMutation({
    mutationFn: (calendarView: CalendarView) => api.saveSettings({ calendarView }),
    onSuccess: (s) => qc.setQueryData(['settings'], s),
  });
  const view = settings.data?.calendarView ?? 'HEATMAP';

  return (
    <section className="rounded-2xl border border-slate-200 bg-surface p-5">
      <div className="flex flex-wrap items-center gap-6">
        <Stat label="Current streak" value={streak.data?.current} accent>
          {streak.data && !streak.data.todayQualified && streak.data.current > 0 && (
            <span className="text-xs text-amber-700">Complete one topic or revision today to keep it</span>
          )}
        </Stat>
        <Stat label="Longest streak" value={streak.data?.longest} />
        <div className="ml-auto">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            View
            <select
              className="rounded-lg border border-slate-300 bg-surface px-2 py-1 text-sm"
              value={view}
              onChange={(e) => setView.mutate(e.target.value as CalendarView)}
            >
              <option value="HEATMAP">Heatmap</option>
              <option value="TICKS">Calendar</option>
            </select>
          </label>
        </div>
      </div>
      <div className="mt-5">
        {!calendar.data || !streak.data ? (
          <Spinner />
        ) : view === 'HEATMAP' ? (
          <Heatmap days={calendar.data} today={streak.data.today} />
        ) : (
          <TickCalendar days={calendar.data} today={streak.data.today} />
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, accent, children }: { label: string; value?: number; accent?: boolean; children?: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-orange-600' : 'text-slate-900'}`}>
        {accent && '🔥 '}
        {value ?? '–'}
        <span className="ml-1 text-base font-medium text-slate-500">{value === 1 ? 'day' : 'days'}</span>
      </p>
      {children}
    </div>
  );
}

function Heatmap({ days, today }: { days: CalendarDay[]; today: Day }) {
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  // 53 columns of Sun→Sat weeks, ending with the week containing today.
  const start = addDays(today, -dayOfWeek(today) - 52 * 7);
  const weeks: Day[][] = Array.from({ length: 53 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const monthLabel = (week: Day[]) => {
    const first = week.find((d) => d.endsWith('-01'));
    return first ? new Date(`${first}T00:00`).toLocaleString(undefined, { month: 'short' }) : '';
  };
  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex flex-col gap-1">
        <div className="flex gap-[3px] pl-7 text-[10px] text-slate-500">
          {weeks.map((w, i) => (
            <span key={i} className="w-[11px] overflow-visible whitespace-nowrap">
              {monthLabel(w)}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          <div className="mr-1 flex w-6 flex-col gap-[3px] text-[10px] leading-[11px] text-slate-500">
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((l, i) => (
              <span key={i} className="h-[11px]">
                {l}
              </span>
            ))}
          </div>
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {w.map((d) => {
                if (d > today) return <span key={d} className="h-[11px] w-[11px]" />;
                const entry = byDay.get(d) ?? { day: d, minutes: 0, learnings: 0, revisions: 0 };
                return (
                  <Link
                    key={d}
                    to={dayLink(d)}
                    title={tip(entry)}
                    aria-label={tip(entry)}
                    className={`block h-[11px] w-[11px] rounded-[2px] transition-transform hover:scale-125 hover:ring-2 hover:ring-indigo-500 ${HEAT[heatLevel(entry.minutes)]} ${d === today ? 'ring-1 ring-slate-500' : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
          Less
          {HEAT.map((c) => (
            <span key={c} className={`h-[11px] w-[11px] rounded-[2px] ${c}`} />
          ))}
          More
        </div>
      </div>
    </div>
  );
}

function TickCalendar({ days, today }: { days: CalendarDay[]; today: Day }) {
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  // The rightmost of the three months shown; never later than the current month.
  const [end, setEnd] = useState(today.slice(0, 7)); // YYYY-MM
  const [ey, em] = end.split('-').map(Number);
  const monthAt = (offset: number) => {
    const d = new Date(ey, em - 1 + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const months = [monthAt(-2), monthAt(-1), end];
  const atLatest = end >= today.slice(0, 7);

  return (
    <div className="flex items-start gap-2">
      <NavButton label="Earlier months" onClick={() => setEnd(monthAt(-1))}>
        ‹
      </NavButton>
      <div className="flex flex-1 flex-wrap justify-around gap-x-6 gap-y-4">
        {months.map((m) => (
          <MiniMonth key={m} month={m} today={today} byDay={byDay} />
        ))}
      </div>
      <NavButton label="Later months" disabled={atLatest} onClick={() => setEnd(monthAt(1))}>
        ›
      </NavButton>
    </div>
  );
}

function NavButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="mt-6 rounded-md px-2 py-1 text-slate-600 transition-colors enabled:hover:bg-indigo-50 enabled:hover:text-indigo-700 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** One month as a compact 7-column grid of small cells (F-29). */
function MiniMonth({ month, today, byDay }: { month: string; today: Day; byDay: Map<Day, CalendarDay> }) {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const count = new Date(y, m, 0).getDate();
  const cells: (Day | null)[] = [...Array(dayOfWeek(first)).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))];
  const studied = cells.filter((d) => {
    const e = d && byDay.get(d);
    return e && (e.learnings || e.revisions);
  }).length;

  return (
    <div>
      <p className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-slate-700">{new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })}</span>
        <span className="text-slate-500">{studied} days</span>
      </p>
      <div className="grid grid-cols-7 gap-[3px]">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="h-3 w-[22px] text-center text-[9px] leading-3 text-slate-400">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} className="h-[22px] w-[22px]" />;
          const e = byDay.get(d);
          const qualified = !!(e && (e.learnings || e.revisions));
          const future = d > today;
          const bg = future ? '' : qualified ? HEAT[Math.max(2, heatLevel(e!.minutes))] : e && e.minutes > 0 ? HEAT[1] : HEAT[0];
          const text = qualified && heatLevel(e!.minutes) >= 3 ? 'text-white dark:text-gray-900' : future ? 'text-slate-300' : 'text-slate-600';
          const cls = `grid h-[22px] w-[22px] place-items-center rounded-[4px] text-[10px] tabular-nums ${bg} ${text} ${
            d === today ? 'ring-2 ring-indigo-500' : ''
          }`;
          if (future)
            return (
              <span key={d} className={cls}>
                {Number(d.slice(8))}
              </span>
            );
          return (
            <Link key={d} to={dayLink(d)} title={e ? tip(e) : `${fmtDay(d)} · click for details`} className={`${cls} transition-shadow hover:ring-2 hover:ring-indigo-500`}>
              {Number(d.slice(8))}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
