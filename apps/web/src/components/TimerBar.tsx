import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { fmtClock, liveSeconds } from '../lib/format';
import { useNow } from '../lib/useNow';
import { useActions } from './Actions';
import { Badge, Button } from './ui';

/** F-16: persistent bar showing the running (or most recently paused) activity. */
export function TimerBar() {
  const timer = useQuery({ queryKey: ['timer'], queryFn: api.timer, refetchInterval: 60_000 });
  const actions = useActions();
  const shown = timer.data?.running ?? timer.data?.paused[0] ?? null;
  const now = useNow(!!timer.data?.running);
  if (!shown) return null;

  const otherPaused = (timer.data?.paused.length ?? 0) - (timer.data?.running ? 0 : 1);
  const running = !!shown.liveSince;
  const elapsed = liveSeconds(shown.totalSeconds, shown.liveSince, now);

  return (
    <>
      <div className="h-20" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-surface/95 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${running ? 'animate-pulse bg-emerald-500' : 'bg-amber-400'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                to={`/fields/${shown.fieldId}?topic=${shown.topicId}`}
                className="truncate font-medium text-slate-900 hover:text-indigo-700"
              >
                {shown.topicName}
              </Link>
              <Badge tone={shown.type === 'LEARNING' ? 'indigo' : 'violet'}>{shown.type === 'LEARNING' ? 'Learning' : 'Revision'}</Badge>
              {!running && <Badge tone="amber">Paused</Badge>}
            </div>
            <p className="truncate text-xs text-slate-500">
              {shown.fieldName}
              {otherPaused > 0 && ` · +${otherPaused} paused`}
            </p>
          </div>
          <span className={`font-mono text-xl tabular-nums ${running ? 'text-slate-900' : 'text-slate-400'}`}>{fmtClock(elapsed)}</span>
          <div className="flex gap-2">
            {shown.type === 'REVISION' && (
              <Button size="sm" variant="ghost" onClick={() => actions.openRecall(shown.topicId)}>
                Recall card
              </Button>
            )}
            {running ? (
              <Button disabled={actions.busy} onClick={() => actions.pause(shown.id)}>
                Pause
              </Button>
            ) : (
              <Button disabled={actions.busy} variant="success" onClick={() => actions.resume(shown.id)}>
                Resume
              </Button>
            )}
            <Button disabled={actions.busy} variant="primary" onClick={() => actions.end(shown)}>
              End
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
