import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { fmtDateTime, fmtDuration, toLocalInput } from '../lib/format';
import { useNow } from '../lib/useNow';
import { useToast } from './Toasts';
import { Button, ErrorText, FormField, inputCls, Modal } from './ui';

/** F-05: catches a timer that was left running far longer than a real session. */
export function LongSessionGuard() {
  const qc = useQueryClient();
  const toast = useToast();
  const timer = useQuery({ queryKey: ['timer'], queryFn: api.timer, refetchInterval: 60_000 });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const now = useNow(true, 60_000);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState(false);
  const [endAt, setEndAt] = useState('');

  const running = timer.data?.running;
  const segStart = running?.liveSince ? Date.parse(running.liveSince) : null;
  const limitMs = (settings.data?.longSessionMinutes ?? 180) * 60_000;
  const show = !!running?.segmentId && segStart !== null && now - segStart > limitMs && !dismissed.has(running.segmentId);

  const save = useMutation({
    mutationFn: () => api.endSegment(running!.segmentId!, new Date(endAt).toISOString()),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries();
      toast('Session time corrected. The topic is paused.', 'success');
    },
  });

  if (!show || !running || segStart === null) return null;
  const dismiss = () => setDismissed((s) => new Set(s).add(running.segmentId!));

  return (
    <Modal
      open
      onClose={dismiss}
      title="Still studying?"
      footer={
        editing ? (
          <>
            <Button onClick={() => setEditing(false)}>Back</Button>
            <Button variant="primary" disabled={!endAt || save.isPending} onClick={() => save.mutate()}>
              Save end time
            </Button>
          </>
        ) : (
          <>
            <Button onClick={dismiss}>Keep it</Button>
            <Button
              variant="primary"
              onClick={() => {
                setEndAt(toLocalInput(new Date(Math.min(now, segStart + 60 * 60_000))));
                setEditing(true);
              }}
            >
              Set real end time
            </Button>
          </>
        )
      }
    >
      <p className="text-sm text-slate-700">
        You've been on <strong>{running.topicName}</strong> for <strong>{fmtDuration((now - segStart) / 1000)}</strong> without a break
        (since {fmtDateTime(running.liveSince)}). Did you forget to press Pause or End?
      </p>
      {editing && (
        <div className="mt-4 space-y-3">
          <FormField label="When did you actually stop?">
            <input
              type="datetime-local"
              className={inputCls}
              value={endAt}
              min={toLocalInput(new Date(segStart))}
              max={toLocalInput(new Date())}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </FormField>
          <ErrorText error={save.error} />
        </div>
      )}
    </Modal>
  );
}
