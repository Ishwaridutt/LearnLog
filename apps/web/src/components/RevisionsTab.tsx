import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { diffDays, type Topic } from '@study/shared';
import { api } from '../api/client';
import { fmtDate, fmtDay, relDay } from '../lib/format';
import { useSettingsSteps } from '../lib/useSettingsSteps';
import { TopicActions } from './TopicActions';
import { Badge, Empty, Spinner } from './ui';

/** F-10 Revisions tab: Due now (capped) + Upcoming (next 2 days). */
export function RevisionsTab({ fieldId, onOpen }: { fieldId: string; onOpen: (id: string) => void }) {
  const lists = useQuery({ queryKey: ['revisions', fieldId], queryFn: () => api.revisions(fieldId) });
  const steps = useSettingsSteps();
  const [showAll, setShowAll] = useState(false);
  if (lists.isPending) return <Spinner />;
  if (!lists.data) return null;
  const { dueNow, upcoming, cap, today } = lists.data;
  const visible = showAll ? dueNow : dueNow.slice(0, cap);
  const hidden = dueNow.length - visible.length;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-semibold text-slate-900">
            Due now <span className="ml-1 text-sm font-normal text-slate-500">{dueNow.length}</span>
          </h3>
          {dueNow.length > cap && <span className="text-xs text-slate-500">Today's {cap}, most overdue first</span>}
        </div>
        {!dueNow.length ? (
          <Empty title="All caught up 🎉">Nothing is due. Learn something new, or revise an upcoming topic early.</Empty>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {visible.map((t) => (
                <RevisionRow key={t.id} topic={t} today={today} steps={steps} onOpen={onOpen} />
              ))}
            </ul>
            {hidden > 0 && (
              <button className="mt-2 text-sm font-medium text-indigo-700 hover:underline" onClick={() => setShowAll(true)}>
                +{hidden} more due
              </button>
            )}
            {showAll && dueNow.length > cap && (
              <button className="mt-2 text-sm text-slate-500 hover:underline" onClick={() => setShowAll(false)}>
                Show only today's {cap}
              </button>
            )}
          </>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-900">
          Upcoming <span className="ml-1 text-sm font-normal text-slate-500">next 2 days · {upcoming.length}</span>
        </h3>
        {!upcoming.length ? (
          <p className="text-sm text-slate-500">Nothing scheduled for the next 2 days.</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {upcoming.map((t) => (
              <RevisionRow key={t.id} topic={t} today={today} steps={steps} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RevisionRow({ topic: t, today, steps, onOpen }: { topic: Topic; today: string; steps: number; onOpen: (id: string) => void }) {
  const overdue = t.nextDueDay ? diffDays(today, t.nextDueDay) : 0;
  return (
    <li className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(t.id)}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900 hover:text-indigo-700">{t.name}</span>
          {overdue > 0 ? (
            <Badge tone="red">Overdue by {overdue} day{overdue === 1 ? '' : 's'}</Badge>
          ) : t.nextDueDay === today ? (
            <Badge tone="amber">Due today</Badge>
          ) : (
            <Badge>{t.nextDueDay ? `${fmtDay(t.nextDueDay)} · ${relDay(t.nextDueDay, today)}` : ''}</Badge>
          )}
          {t.recallPrompt && <Badge tone="indigo">Recall prompt</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Step {(t.reviewStep ?? 0) + 1}/{steps} · Last revised {t.lastRevisedAt ? fmtDate(t.lastRevisedAt) : 'not yet'} · Completed {fmtDate(t.completedAt)}
        </p>
      </button>
      <TopicActions topic={t} />
    </li>
  );
}
