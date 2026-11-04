import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { addDays, dayOfWeek, heatLevel, type CalendarDay, type CalendarView, type Day } from '@study/shared';
import { api } from '../api/client';
import { fmtDay } from '../lib/format';
import { Spinner } from './ui';

const HEAT = ['bg-slate-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600', 'bg-emerald-800'];

const tip = (d: CalendarDay) =>
  `${fmtDay(d.day)}: ${d.minutes} min · ${d.learnings} learned · ${d.revisions} revised`;

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
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
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
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
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
                  <span
                    key={d}
                    title={tip(entry)}
                    className={`h-[11px] w-[11px] rounded-[2px] ${HEAT[heatLevel(entry.minutes)]} ${d === today ? 'ring-1 ring-slate-500' : ''}`}
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
  const [month, setMonth] = useState(today.slice(0, 7)); // YYYY-MM
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = dayOfWeek(first);
  const cells: (Day | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i))];
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const studied = cells.filter((d) => d && (byDay.get(d)?.learnings || byDay.get(d)?.revisions)).length;

  return (
    <div className="max-w-md">
      <div className="mb-2 flex items-center justify-between">
        <button className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100" onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <p className="text-sm font-medium text-slate-800">
          {new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          <span className="ml-2 text-xs font-normal text-slate-500">{studied} study days</span>
        </p>
        <button
          className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          onClick={() => shift(1)}
          disabled={month >= today.slice(0, 7)}
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d} className="py-1 text-slate-500">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const e = byDay.get(d);
          const ok = !!(e && (e.learnings || e.revisions));
          return (
            <span
              key={d}
              title={e ? tip(e) : fmtDay(d)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg ${
                ok ? 'bg-emerald-100 text-emerald-800' : d > today ? 'text-slate-300' : 'bg-slate-50 text-slate-500'
              } ${d === today ? 'ring-2 ring-indigo-400' : ''}`}
            >
              <span>{Number(d.slice(8))}</span>
              {ok && <span className="text-[11px] leading-none">✓</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
