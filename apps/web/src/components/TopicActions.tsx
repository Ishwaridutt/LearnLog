import { createContext, useContext } from 'react';
import type { Topic } from '@study/shared';
import { useActions } from './Actions';
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
  if (topic.status === 'COMPLETED' || topic.status === 'MASTERED') {
    return (
      <Button size={size} disabled={a.busy} onClick={() => a.startRevision(topic)}>
        ↻ Revise
      </Button>
    );
  }
  return null;
}
