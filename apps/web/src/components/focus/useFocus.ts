import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { focusEndsAt, focusRemaining, focusUsed, type FocusCurrent, type FocusSession, type FocusStartInput } from '@study/shared';
import { api } from '../../api/client';
import { useNow } from '../../lib/useNow';
import { unlockAudio } from '../../lib/sounds';
import { useToast } from '../Toasts';

export const FOCUS_KEY = ['focus'] as const;

/** Current focus session; refetched every 30 s and whenever a tab regains focus. */
export function useFocusCurrent() {
  return useQuery({ queryKey: FOCUS_KEY, queryFn: api.focusCurrent, refetchInterval: 30_000 });
}

/** Live numbers for a session, ticking every second while it runs. */
export function useFocusClock(s: FocusSession | null | undefined) {
  const now = useNow(s?.status === 'RUNNING');
  if (!s) return null;
  return {
    used: focusUsed(s, now),
    remaining: focusRemaining(s, now),
    progress: Math.min(1, focusUsed(s, now) / s.plannedSeconds),
    endsAt: focusEndsAt(s),
  };
}

/** All focus actions. A linked topic's timer changes too, so every query is refreshed afterwards. */
export function useFocusActions() {
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: (fn: () => Promise<FocusCurrent>) => fn(),
    onSuccess: (data) => {
      qc.setQueryData(FOCUS_KEY, data);
      void qc.invalidateQueries();
    },
    onError: (e) => toast(e.message, 'error'),
  });
  const run = (fn: () => Promise<FocusCurrent>) => m.mutateAsync(fn).catch(() => undefined);
  return {
    pending: m.isPending,
    start: (input: FocusStartInput) => {
      unlockAudio(); // inside the click, so the alarm may play later
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
      return run(() => api.focusStart(input));
    },
    pause: (id: string) => run(() => api.focusPause(id)),
    resume: (id: string) => {
      unlockAudio();
      return run(() => api.focusResume(id));
    },
    stop: (id: string) => run(() => api.focusStop(id)),
    edit: (id: string, plannedSeconds: number) => run(() => api.focusEdit(id, plannedSeconds)),
    remove: (id: string) => run(() => api.focusDelete(id)),
  };
}

export const KIND_LABEL = { FOCUS: 'Focus', BREAK: 'Break' } as const;
export const STATUS_LABEL = { RUNNING: 'Running', PAUSED: 'Paused', COMPLETED: 'Completed', STOPPED: 'Stopped early' } as const;
export const STATUS_TONE = { RUNNING: 'green', PAUSED: 'amber', COMPLETED: 'indigo', STOPPED: 'slate' } as const;
