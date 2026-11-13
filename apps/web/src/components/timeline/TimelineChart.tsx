import { useMemo, useState } from 'react';
import type { Day, Timeline } from '@study/shared';
import { FOCUS_FILL, FOCUS_LABEL, fmtDayNum, fmtShortDay, fmtSpent, fmtWeekday } from './useTimeline';
import { Swatch } from './SplitBar';

const CHART_H = 200;

/** A round axis maximum and tick step for a peak in seconds: 15/30 min steps under 2h, then whole hours. */
function scale(peak: number): { max: number; step: number } {
  const steps = [900, 1800, 3600, 7200, 10800, 14400];
  const step = steps.find((s) => peak / s <= 4) ?? 14400;
  return { max: Math.max(step, Math.ceil(peak / step) * step), step };
}

const tickLabel = (secs: number) => (secs % 3600 === 0 ? `${secs / 3600}h` : `${Math.floor(secs / 3600) ? `${Math.floor(secs / 3600)}h` : ''}${(secs % 3600) / 60}m`);

/**
 * Minutes per day as stacked bars, one colour per subject (the subject's own colour), with
 * unlinked focus time hatched on top. Hover shows the split; click picks the day.
 */
export function TimelineChart({
  data,
  extraToday,
  selected,
  onSelect,
}: {
  data: Timeline;
  /** Live seconds to add to today's bar, keyed like a subject (null = unlinked focus). */
  extraToday: { fieldId: string | null; seconds: number } | null;
  selected: Day | null;
  onSelect: (day: Day) => void;
}) {
  const [hover, setHover] = useState<Day | null>(null);
  const subjects = useMemo(() => new Map(data.subjects.map((s) => [s.fieldId, s])), [data.subjects]);
  // Stack order follows the legend (largest subject in the range at the bottom), so colours sit in the same place every day.
  const order = useMemo(() => new Map(data.subjects.map((s, i) => [s.fieldId, i])), [data.subjects]);

  const days = useMemo(
    () =>
      data.days.map((d) => {
        let subs = d.subjects.map((s) => ({ ...s }));
        let focus = d.focusSeconds;
        if (extraToday && d.day === data.today && extraToday.seconds > 0) {
          if (extraToday.fieldId) {
            const hit = subs.find((s) => s.fieldId === extraToday.fieldId);
            if (hit) hit.seconds += extraToday.seconds;
            else subs = [...subs, { fieldId: extraToday.fieldId, seconds: extraToday.seconds }];
          } else focus += extraToday.seconds;
        }
        subs.sort((a, b) => (order.get(a.fieldId) ?? 99) - (order.get(b.fieldId) ?? 99));
        return { day: d.day, subjects: subs, focus, total: subs.reduce((n, s) => n + s.seconds, 0) + focus, future: d.day > data.today };
      }),
    [data, extraToday, order],
  );

  const peak = Math.max(0, ...days.map((d) => d.total));
  const { max, step } = scale(peak);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const n = days.length;
  const labelEvery = n <= 7 ? 1 : n <= 31 ? 5 : 14;
  const gap = n <= 7 ? 'gap-3' : n <= 31 ? 'gap-1' : 'gap-px';
  const hoverDay = days.find((d) => d.day === hover);
  const hasFocus = days.some((d) => d.focus > 0);

  return (
    <div>
      <div className="relative flex" style={{ height: CHART_H + 34 }}>
        {/* y axis */}
        <div className="relative w-9 shrink-0 text-[10px] text-slate-400 tabular-nums" style={{ height: CHART_H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-1.5 translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
              {t ? tickLabel(t) : '0'}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: CHART_H }}>
            {ticks.map((t) => (
              <span key={t} className={`absolute inset-x-0 border-t ${t ? 'border-dashed border-slate-200' : 'border-slate-300'}`} style={{ bottom: `${(t / max) * 100}%` }} />
            ))}
          </div>
          <div className={`relative flex h-full ${gap}`} onMouseLeave={() => setHover(null)}>
            {days.map((d, i) => {
              const isSel = d.day === selected;
              const isToday = d.day === data.today;
              const showLabel = n <= 7 || isToday || (i % labelEvery === 0 && n - 1 - i >= labelEvery / 2);
              return (
                <button
                  key={d.day}
                  type="button"
                  disabled={d.future}
                  onClick={() => onSelect(d.day)}
                  onMouseEnter={() => setHover(d.day)}
                  onFocus={() => setHover(d.day)}
                  onBlur={() => setHover(null)}
                  aria-pressed={isSel}
                  aria-label={`${fmtShortDay(d.day)}: ${fmtSpent(d.total)}`}
                  className="group relative flex min-w-0 flex-1 flex-col outline-none disabled:cursor-default"
                >
                  <span
                    className={`relative flex w-full flex-col-reverse justify-start rounded-t-md transition-colors ${
                      isSel ? 'bg-indigo-100/70' : 'group-enabled:group-hover:bg-slate-100 group-focus-visible:bg-slate-100'
                    }`}
                    style={{ height: CHART_H }}
                  >
                    <span className="flex w-full flex-col-reverse gap-[2px] px-[12%]" style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total ? 2 : 0 }}>
                      {d.subjects.map((s) => (
                        <span key={s.fieldId} className="w-full last:rounded-t-[4px]" style={{ flexGrow: s.seconds, minHeight: 1, background: subjects.get(s.fieldId)?.color ?? 'var(--color-slate-400)' }} />
                      ))}
                      {d.focus > 0 && <span className="w-full rounded-t-[4px]" style={{ flexGrow: d.focus, minHeight: 1, background: FOCUS_FILL }} />}
                    </span>
                  </span>
                  {/* Labels are wider than thin bars, so they overflow centred under their bar. */}
                  <span className="relative mt-1.5 block h-7 w-full">
                    {showLabel && (
                      <span
                        className={`absolute top-0 whitespace-nowrap text-center text-[10px] leading-tight tabular-nums ${
                          // Phones: only the first day and today, so dates never collide.
                          n > 7 && i !== 0 && !isToday ? 'max-sm:hidden' : ''
                        } ${
                          i === 0 && n > 7 ? 'left-0' : i === n - 1 && n > 7 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                        } ${isSel ? 'font-semibold text-indigo-700' : isToday ? 'font-medium text-slate-700' : 'text-slate-400'}`}
                      >
                        {isToday && n > 7 ? (
                          'Today'
                        ) : n <= 7 ? (
                          <>
                            {fmtWeekday(d.day)}
                            <span className="block font-normal text-slate-400">{fmtDayNum(d.day)}</span>
                          </>
                        ) : (
                          fmtDayNum(d.day)
                        )}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {hoverDay && !hoverDay.future && <Tooltip day={hoverDay} index={days.indexOf(hoverDay)} count={n} subjects={subjects} />}
        </div>
      </div>

      {/* legend: always shown, so identity is never colour alone */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 pl-9 text-xs text-slate-600">
        {data.subjects.map((s) => (
          <li key={s.fieldId} className="flex items-center gap-1.5">
            <Swatch color={s.color} />
            {s.name}
            <span className="text-slate-400 tabular-nums">{fmtSpent(s.seconds)}</span>
          </li>
        ))}
        {hasFocus && (
          <li className="flex items-center gap-1.5">
            <Swatch color={null} />
            {FOCUS_LABEL}
          </li>
        )}
      </ul>
    </div>
  );
}

function Tooltip({
  day,
  index,
  count,
  subjects,
}: {
  day: { day: Day; subjects: { fieldId: string; seconds: number }[]; focus: number; total: number };
  index: number;
  count: number;
  subjects: Map<string, { name: string; color: string }>;
}) {
  const centre = ((index + 0.5) / count) * 100;
  const align = centre < 25 ? 'translate-x-0' : centre > 75 ? '-translate-x-full' : '-translate-x-1/2';
  const rows = [...day.subjects].sort((a, b) => b.seconds - a.seconds);
  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute top-1 z-10 w-56 rounded-xl border border-slate-200 bg-surface p-3 text-xs shadow-lg ${align}`}
      style={{ left: `${centre}%` }}
    >
      <p className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-slate-900">{fmtShortDay(day.day)}</span>
        <span className="font-semibold text-slate-900 tabular-nums">{fmtSpent(day.total)}</span>
      </p>
      {day.total === 0 ? (
        <p className="mt-1 text-slate-500">No study recorded</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map((s) => (
            <li key={s.fieldId} className="flex items-center gap-1.5 text-slate-600">
              <Swatch color={subjects.get(s.fieldId)?.color ?? null} />
              <span className="min-w-0 flex-1 truncate">{subjects.get(s.fieldId)?.name ?? 'Subject'}</span>
              <span className="tabular-nums">{fmtSpent(s.seconds)}</span>
            </li>
          ))}
          {day.focus > 0 && (
            <li className="flex items-center gap-1.5 text-slate-600">
              <Swatch color={null} />
              <span className="min-w-0 flex-1 truncate">{FOCUS_LABEL}</span>
              <span className="tabular-nums">{fmtSpent(day.focus)}</span>
            </li>
          )}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-slate-400">Click for details</p>
    </div>
  );
}
