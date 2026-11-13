import { Link } from 'react-router-dom';
import { addDays, type Day, type DayDetail, type DaySession } from '@study/shared';
import { fmtTime } from '../../lib/format';
import { useNow } from '../../lib/useNow';
import { Badge, ErrorText, Spinner } from '../ui';
import { focusPart, SplitBar, Swatch, type SplitPart } from './SplitBar';
import { FOCUS_LABEL, fmtLongDay, fmtSpent, liveExtra, useDay } from './useTimeline';

const KIND: Record<DaySession['kind'], { label: string; tone: 'indigo' | 'violet' | 'slate' }> = {
  LEARNING: { label: 'Learning', tone: 'indigo' },
  REVISION: { label: 'Revision', tone: 'violet' },
  FOCUS: { label: 'Focus', tone: 'slate' },
};

/** Live view of a day: adds the running stretch to the subject (or unlinked focus) that is ticking. */
export function useLiveDayTotals(data: DayDetail | undefined) {
  const now = useNow(!!data?.live, 1000);
  const extra = data ? liveExtra(data.asOf, data.live, now) : 0;
  const liveField = data?.live ? data.live.fieldId : undefined;
  const subjects = (data?.subjects ?? []).map((s) => (s.fieldId === liveField ? { ...s, seconds: s.seconds + extra } : s));
  const focusSeconds = (data?.focusSeconds ?? 0) + (data?.live && liveField === null ? extra : 0);
  const seconds = (data?.seconds ?? 0) + extra;
  const parts: SplitPart[] = [
    ...subjects.map((s) => ({ key: s.fieldId, label: s.name, seconds: s.seconds, color: s.color })),
    ...(focusSeconds > 0 ? [focusPart(focusSeconds)] : []),
  ];
  return { subjects, focusSeconds, seconds, parts, extra, now };
}

/** F-38: everything studied on one day: subject → topic totals, then each session in order. */
export function DayDetailPanel({ day, onDay }: { day: Day; onDay: (day: Day) => void }) {
  const q = useDay(day);
  const data = q.data?.day === day ? q.data : undefined;
  const live = useLiveDayTotals(data);
  const today = q.data?.today;

  return (
    <section className="rounded-2xl border border-slate-200 bg-surface p-5" aria-label="Day details">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{day === today ? 'Today' : day === (today && addDays(today, -1)) ? 'Yesterday' : 'Day'}</p>
          <h2 className="font-semibold text-slate-900">{fmtLongDay(day)}</h2>
        </div>
        <div className="flex items-center gap-1">
          <DayNav label="Previous day" onClick={() => onDay(addDays(day, -1))}>
            ‹
          </DayNav>
          <DayNav label="Next day" disabled={!today || day >= today} onClick={() => onDay(addDays(day, 1))}>
            ›
          </DayNav>
        </div>
      </div>

      {q.error ? (
        <ErrorText error={q.error} />
      ) : !data ? (
        <div className="py-8">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-slate-900 tabular-nums">{fmtSpent(live.seconds)}</p>
            {data.live && (
              <Badge tone="green">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" /> Timer running
              </Badge>
            )}
          </div>
          <SplitBar parts={live.parts} className="mt-3 h-3" />

          {!data.sessions.length ? (
            <p className="mt-6 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No study recorded on this day.</p>
          ) : (
            <>
              <h3 className="mt-6 mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">By subject</h3>
              <ul className="space-y-3">
                {live.subjects.map((s) => (
                  <li key={s.fieldId}>
                    <div className="flex items-center gap-2 text-sm">
                      <Swatch color={s.color} />
                      <Link to={`/fields/${s.fieldId}`} className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-indigo-700">
                        {s.name}
                      </Link>
                      <span className="text-xs text-slate-400 tabular-nums">{Math.round((s.seconds / live.seconds) * 100)}%</span>
                      <span className="w-16 text-right font-semibold text-slate-900 tabular-nums">{fmtSpent(s.seconds)}</span>
                    </div>
                    <ul className="mt-1 ml-[5px] space-y-0.5 border-l border-slate-200 pl-4">
                      {s.topics.map((t) => (
                        <li key={t.topicId} className="flex items-center gap-2 text-sm">
                          <Link to={`/fields/${s.fieldId}?topic=${t.topicId}`} className="min-w-0 flex-1 truncate text-slate-600 hover:text-indigo-700" title={t.name}>
                            {t.name}
                          </Link>
                          {t.learningSeconds > 0 && t.revisionSeconds > 0 ? (
                            <span className="hidden text-[11px] text-slate-400 sm:inline">
                              learn {fmtSpent(t.learningSeconds)} · revise {fmtSpent(t.revisionSeconds)}
                            </span>
                          ) : (
                            <span className="hidden text-[11px] text-slate-400 sm:inline">{t.revisionSeconds ? 'revision' : 'learning'}</span>
                          )}
                          <span className="w-16 text-right text-slate-700 tabular-nums">{fmtSpent(t.seconds + (data.live?.fieldId === s.fieldId && isLiveTopic(data, t.topicId) ? live.extra : 0))}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
                {live.focusSeconds > 0 && (
                  <li className="flex items-center gap-2 text-sm">
                    <Swatch color={null} />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{FOCUS_LABEL}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{Math.round((live.focusSeconds / live.seconds) * 100)}%</span>
                    <span className="w-16 text-right font-semibold text-slate-900 tabular-nums">{fmtSpent(live.focusSeconds)}</span>
                  </li>
                )}
              </ul>

              <h3 className="mt-6 mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Sessions · {data.sessions.length}</h3>
              <ol className="divide-y divide-slate-100">
                {data.sessions.map((s) => (
                  <SessionRow key={s.id} s={s} extra={s.endedAt ? 0 : live.extra} />
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** The running session's topic, so only that topic's row ticks. */
function isLiveTopic(data: DayDetail, topicId: string) {
  return data.sessions.some((s) => !s.endedAt && s.topicId === topicId);
}

function SessionRow({ s, extra }: { s: DaySession; extra: number }) {
  const k = KIND[s.kind];
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className="w-[5.5rem] shrink-0 text-xs text-slate-500 tabular-nums sm:w-[6.5rem]">
        {fmtTime(s.startedAt)} – {s.endedAt ? fmtTime(s.endedAt) : <span className="font-medium text-emerald-700">now</span>}
      </span>
      <Swatch color={s.color} />
      <span className="min-w-0 flex-1">
        {s.topicId ? (
          <Link to={`/fields/${s.fieldId}?topic=${s.topicId}`} className="block truncate text-slate-800 hover:text-indigo-700" title={s.topicName ?? ''}>
            {s.topicName}
          </Link>
        ) : (
          <span className="block truncate text-slate-800">Focus countdown</span>
        )}
        <span className="block truncate text-xs text-slate-400">
          {s.fieldName ?? 'No topic linked'}
          {s.parts > 1 && ` · ${s.parts} stretches`}
        </span>
      </span>
      <span className="hidden sm:block">
        <Badge tone={k.tone}>{k.label}</Badge>
      </span>
      <span className="w-14 text-right font-medium text-slate-700 tabular-nums">{fmtSpent(s.seconds + extra)}</span>
    </li>
  );
}

function DayNav({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: string }) {
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
