import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ActionResult, ActivityType, Grade } from '@study/shared';
import { api } from '../api/client';
import { fmtDuration } from '../lib/format';
import { RevisionModal } from './RevisionModal';
import { useToast } from './Toasts';

/** Every timer action in the app goes through here, so toasts and refreshes are consistent. */
interface Actions {
  startLearning: (topicId: string) => void;
  startRevision: (topic: { id: string; recallPrompt: string | null }) => void;
  pause: (activityId: string) => void;
  resume: (activityId: string) => void;
  /** Ends learning immediately; for a revision opens the grade picker. */
  end: (activity: { id: string; type: ActivityType; topicId: string }) => void;
  openRecall: (topicId: string) => void;
  busy: boolean;
}

const Ctx = createContext<Actions | null>(null);

export function useActions(): Actions {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useActions outside ActionsProvider');
  return ctx;
}

type ModalState = { mode: 'recall' | 'grade'; topicId: string; activityId?: string } | null;

export function ActionsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);

  const after = useCallback(
    (res: ActionResult | void, message?: string) => {
      qc.invalidateQueries();
      if (res && res.autoPaused) {
        toast(`Paused "${res.autoPaused.topicName}" (${fmtDuration(res.autoPaused.totalSeconds)})`);
      }
      if (message) toast(message, 'success');
    },
    [qc, toast],
  );

  const run = useMutation({
    mutationFn: (fn: () => Promise<{ res: ActionResult | void; message?: string }>) => fn(),
    onSuccess: ({ res, message }) => after(res, message),
    onError: (e) => toast(e instanceof Error ? e.message : 'Something went wrong', 'error'),
  });
  const exec = run.mutate;

  const gradeMutation = useMutation({
    mutationFn: ({ activityId, grade }: { activityId: string; grade: Grade }) => api.end(activityId, grade),
    onSuccess: (res, { grade }) => {
      setModal(null);
      after(res, grade === 'FORGOT' ? 'Revision logged. It comes back tomorrow.' : 'Revision complete.');
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Something went wrong', 'error'),
  });

  const actions = useMemo<Actions>(
    () => ({
      busy: run.isPending || gradeMutation.isPending,
      startLearning: (topicId) => exec(async () => ({ res: await api.startLearning(topicId) })),
      startRevision: (topic) =>
        exec(async () => {
          const res = await api.startRevision(topic.id);
          if (topic.recallPrompt) setModal({ mode: 'recall', topicId: topic.id, activityId: res.activityId });
          return { res, message: topic.recallPrompt ? undefined : 'Revision started' };
        }),
      pause: (id) => exec(async () => ({ res: await api.pause(id) })),
      resume: (id) => exec(async () => ({ res: await api.resume(id) })),
      end: (activity) => {
        if (activity.type === 'REVISION') {
          setModal({ mode: 'grade', topicId: activity.topicId, activityId: activity.id });
          return;
        }
        exec(async () => ({ res: await api.end(activity.id), message: 'Topic completed. First revision is due tomorrow.' }));
      },
      openRecall: (topicId) => setModal({ mode: 'recall', topicId }),
    }),
    [exec, run.isPending, gradeMutation.isPending],
  );

  return (
    <Ctx.Provider value={actions}>
      {children}
      {modal && (
        <RevisionModal
          mode={modal.mode}
          topicId={modal.topicId}
          onClose={() => setModal(null)}
          onRequestGrade={(activityId) => setModal({ mode: 'grade', topicId: modal.topicId, activityId })}
          onPause={(activityId) => {
            actions.pause(activityId);
            setModal(null);
          }}
          onGrade={(activityId, grade) => gradeMutation.mutate({ activityId, grade })}
          grading={gradeMutation.isPending}
        />
      )}
    </Ctx.Provider>
  );
}
