import { useQuery } from '@tanstack/react-query';
import { WEAK_MIN_FORGOTS, WEAK_WINDOW } from '@study/shared';
import { api } from '../api/client';
import { fmtDate, fmtDay, relDay } from '../lib/format';
import { TopicActions } from './TopicActions';
import { Badge, Empty, rowHover, Spinner } from './ui';

/** F-24: topics you keep forgetting. */
export function WeakTab({ fieldId, today, onOpen }: { fieldId: string; today: string; onOpen: (id: string) => void }) {
  const weak = useQuery({ queryKey: ['weak', fieldId], queryFn: () => api.weak(fieldId) });
  if (weak.isPending) return <Spinner />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Topics with {WEAK_MIN_FORGOTS}+ “Forgot” grades in their last {WEAK_WINDOW} revisions. A quick revision won't fix these: re-learn
        them properly (rewatch, rewrite your notes, sharpen the recall prompt), then let the schedule take over. A topic leaves this list once
        you start remembering it.
      </p>
      {!weak.data?.length ? (
        <Empty title="No weak spots 💪">Nothing has been forgotten repeatedly. Keep revising on schedule.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
          {weak.data.map((t) => (
            <li key={t.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${rowHover}`}>
              <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(t.id)}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{t.name}</span>
                  <Badge tone="red">
                    Forgot {t.recentForgots} of last {t.recentGraded}
                  </Badge>
                  {t.recallRate !== null && <Badge>Recall {Math.round(t.recallRate * 100)}%</Badge>}
                  {!t.recallPrompt && <Badge tone="amber">No recall prompt</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Last forgot {fmtDate(t.lastForgotAt)} · {t.revisionCount} revisions
                  {t.nextDueDay && ` · next ${fmtDay(t.nextDueDay)} (${relDay(t.nextDueDay, today)})`}
                </p>
              </button>
              <TopicActions topic={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
