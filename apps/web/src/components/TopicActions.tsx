import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import type { Topic } from '@study/shared';
import { api } from '../api/client';
import { useActions } from './Actions';
import { useToast } from './Toasts';
import { Button } from './ui';

/** True inside an archived field: timer actions are hidden. */
export const ReadOnlyContext = createContext(false);

/** The right buttons for a topic's current state: Start / Pause / Resume / End / Revise. */
export function TopicActions({ topic, size = 'sm' }: { topic: Topic; size?: 'sm' | 'md' }) {
  const a = useActions();
  const readOnly = useContext(ReadOnlyContext);
  const open = topic.openActivity;
  if (topic.archivedAt || readOnly) return null;

  if (open) {
    return (
      <div className="flex gap-1.5">
        {open.liveSince ? (
          <Button size={size} disabled={a.busy} onClick={() => a.pause(open.id)}>
            Pause
          </Button>
        ) : (
          <Button size={size} variant="success" disabled={a.busy} onClick={() => a.resume(open.id)}>
            Resume
          </Button>
        )}
        <Button size={size} variant="primary" disabled={a.busy} onClick={() => a.end(open)}>
          {open.type === 'REVISION' ? 'End & grade' : 'End'}
        </Button>
      </div>
    );
  }
  if (topic.status === 'NOT_STARTED') {
    return (
      <Button size={size} variant="success" disabled={a.busy} onClick={() => a.startLearning(topic.id)}>
        ▶ Start
      </Button>
    );
  }
  if (topic.status === 'COMPLETED' && topic.skipRevision) {
    // "No revision needed": offer to put it back in the queue instead of revising.
    return <ScheduleRevisionsButton topicId={topic.id} size={size} />;
  }
  if (topic.status === 'COMPLETED' || topic.status === 'MASTERED') {
    return (
      <Button size={size} disabled={a.busy} onClick={() => a.startRevision(topic)}>
        ↻ Revise
      </Button>
    );
  }
  return null;
}

function ScheduleRevisionsButton({ topicId, size }: { topicId: string; size: 'sm' | 'md' }) {
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => api.updateTopic(topicId, { skipRevision: false }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast('Revisions turned back on. The first one is due tomorrow.', 'success');
    },
    onError: (e) => toast(e.message, 'error'),
  });
  return (
    <Button size={size} disabled={m.isPending} title="Put this topic back into the revision queue (first revision tomorrow)" onClick={() => m.mutate()}>
      ↻ Schedule revisions
    </Button>
  );
}
