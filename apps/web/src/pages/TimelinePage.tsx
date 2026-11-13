import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, diffDays, type Day, type Timeline } from '@study/shared';
import { api } from '../api/client';
import { DayDetailPanel } from '../components/timeline/DayDetailPanel';
import { TimelineChart } from '../components/timeline/TimelineChart';
import { fmtDayNum, fmtShortDay, fmtSpent, liveExtra, useTimeline } from '../components/timeline/useTimeline';
import { ErrorText, Spinner } from '../components/ui';
import { useNow } from '../lib/useNow';

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

/** The window end that shows `day`: today when the day is recent enough, otherwise centred on it. */
function endFor(day: Day, range: Range, today: Day): Day {
  if (diffDays(today, day) < range) return today;
  const e = addDays(day, Math.floor(range / 2));
  return e > today ? today : e;
}

/** F-38: study time per day over a range, and the selected day's details. */
export function TimelinePage() {
  const [params, setParams] = useSearchParams();
  const streak = useQuery({ queryKey: ['streak'], queryFn: api.streak });
  const today = streak.data?.today;
  const rangeParam = Number(params.get('range'));
  const range: Range = (RANGES as readonly number[]).includes(rangeParam) ? (rangeParam as Range) : 30;
  const dayParam = params.get('day');
  const selected = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) && (!today || dayParam <= today) ? dayParam : (today ?? null);

  const [end, setEnd] = useState<Day | null>(null);
  // Place the window once today is known, and move it when a picked day falls outside it.
  useEffect(() => {
    if (!today || !selected) return;
    setEnd((cur) => {
      if (cur && selected <= cur && diffDays(cur, selected) < range) return cur;
      return endFor(selected, range, today);
    });
  }, [today, selected, range]);

  const from = end ? addDays(end, -(range - 1)) : undefined;
  const timeline = useTimeline(from, end ?? undefined);
  const data = timeline.data;

  const update = (next: { day?: Day; range?: Range }) => {
    const p = new URLSearchParams(params);
    if (next.day) p.set('day', next.day);
    if (next.range) p.set('range', String(next.range));
    setParams(p, { replace: true });
  };

  const shift = (dir: -1 | 1) => {
    if (!end || !today) return;
    const e = addDays(end, dir * range);
    setEnd(e > today ? today : e);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Timeline</h1>
          <p className="text-sm text-slate-500">How much you studied each day. Pick a day to see where the time went.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-slate-100 p-1 ring-1 ring-slate-200 ring-inset" role="group" aria-label="Range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={r === range}
                onClick={() => update({ range: r })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  r === range ? 'bg-surface text-indigo-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-indigo-700'
                }`}
              >
                {r} days
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-surface p-5" aria-label="Study time per day">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <NavPill label={`Previous ${range} days`} onClick={() => shift(-1)} disabled={!end}>
              ‹
            </NavPill>
            <NavPill label={`Next ${range} days`} onClick={() => shift(1)} disabled={!end || !today || end >= today}>
              ›
            </NavPill>
          </div>
          <p className="text-sm font-medium text-slate-700">
            {from && end ? `${fmtDayNum(from)} – ${fmtDayNum(end)}` : '…'}
          </p>
          {end && today && end < today && (
            <button
              type="button"
              onClick={() => {
                setEnd(today);
                update({ day: today });
              }}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Jump to today
            </button>
          )}
        </div>

        {timeline.error ? (
          <ErrorText error={timeline.error} />
        ) : !data ? (
          <div className="py-16">
            <Spinner />
          </div>
        ) : (
          <>
            <Summary data={data} />
            <LiveChart data={data} selected={selected} onSelect={(d) => update({ day: d })} />
          </>
        )}
      </section>

      {selected && <DayDetailPanel day={selected} onDay={(d) => update({ day: d })} />}
    </div>
  );
}

/** Chart with today's bar ticking while a timer runs. */
function LiveChart({ data, selected, onSelect }: { data: Timeline; selected: Day | null; onSelect: (d: Day) => void }) {
  const now = useNow(!!data.live, 15_000);
  const extra = liveExtra(data.asOf, data.live, now);
  return (
    <TimelineChart data={data} extraToday={data.live ? { fieldId: data.live.fieldId, seconds: extra } : null} selected={selected} onSelect={onSelect} />
  );
}

function Summary({ data }: { data: Timeline }) {
  // Average over days that have happened, so a range ending today isn't diluted by future days.
  const past = data.days.filter((d) => d.day <= data.today);
  const total = past.reduce((n, d) => n + d.seconds, 0);
  const studied = past.filter((d) => d.seconds > 0).length;
  const best = past.reduce<(typeof past)[number] | null>((b, d) => (d.seconds > (b?.seconds ?? 0) ? d : b), null);
  const stats = [
    { label: 'Total', value: fmtSpent(total) },
    { label: 'Daily average', value: fmtSpent(past.length ? total / past.length : 0) },
    { label: 'Days studied', value: `${studied} / ${past.length}` },
    { label: 'Best day', value: best ? fmtSpent(best.seconds) : '–', hint: best ? fmtShortDay(best.day) : undefined },
  ];
  return (
    <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
          <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{s.label}</dt>
          <dd className="text-lg font-semibold text-slate-900 tabular-nums">
            {s.value}
            {s.hint && <span className="ml-1.5 text-xs font-normal text-slate-500">{s.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function NavPill({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full text-lg text-slate-600 ring-1 ring-slate-200 ring-inset transition-colors enabled:hover:bg-indigo-50 enabled:hover:text-indigo-700 enabled:hover:ring-indigo-200 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
