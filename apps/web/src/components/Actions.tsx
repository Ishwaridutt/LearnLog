import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { focusRemaining, type ActionResult, type ActivityType, type FocusSession, type Grade } from '@study/shared';
import { api } from '../api/client';
import { fmtDuration } from '../lib/format';
import { fmtCountdown } from '../lib/focusPrefs';
import { useFocusCurrent } from './focus/useFocus';
import { RevisionModal } from './RevisionModal';
import { useToast } from './Toasts';
import { Button, Modal } from './ui';

/** Every timer action in the app goes through here, so toasts and refreshes are consistent. */
interface Actions {
  startLearning: (topicId: string) => void;
  startRevision: (topic: { id: string; recallPrompt: string | null }) => void;
  pause: (activityId: string) => void;
  resume: (activity: { id: string; topicId: string }) => void;
  /** Ends learning immediately; for a revision opens the grade picker. */
  end: (activity: { id: string; type: ActivityType; topicId: string }) => void;
  openRecall: (topicId: string) => void;
  /** F-23: discard an in-progress revision without recording it. */
  cancelRevision: (activityId: string) => void;
  busy: boolean;
}

const Ctx = createContext<Actions | null>(null);

export function useActions(): Actions {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useActions outside ActionsProvider');
  return ctx;
}

type ModalState = { mode: 'recall' | 'grade'; topicId: string; activityId?: string } | null;
/** A topic timer is about to start while its linked focus countdown is paused: ask before resuming both. */
type FocusAsk = { focus: FocusSession; run: (alsoFocus: boolean) => void } | null;

export function ActionsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [focusAsk, setFocusAsk] = useState<FocusAsk>(null);
  const focus = useFocusCurrent();
  const pausedFocus = focus.data?.active?.status === 'PAUSED' ? focus.data.active : null;

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

  const actions = useMemo<Actions>(() => {
    /**
     * Run a topic start/resume. If that topic's linked focus countdown is paused, ask first;
     * "resume both" starts the topic, then resumes the countdown (which keeps the topic running).
     */
    const guarded = (topicId: string, call: () => Promise<{ res: ActionResult | void; message?: string }>) => {
      const go = (alsoFocus: boolean) =>
        exec(async () => {
          const out = await call();
          if (!alsoFocus || !pausedFocus) return out;
          await api.focusResume(pausedFocus.id);
          return { ...out, message: 'Topic and focus timer resumed' };
        });
      if (pausedFocus?.topicId === topicId) setFocusAsk({ focus: pausedFocus, run: go });
      else go(false);
    };
    return {
      busy: run.isPending || gradeMutation.isPending,
      startLearning: (topicId) => guarded(topicId, async () => ({ res: await api.startLearning(topicId) })),
      startRevision: (topic) =>
        guarded(topic.id, async () => {
          const res = await api.startRevision(topic.id);
          if (topic.recallPrompt) setModal({ mode: 'recall', topicId: topic.id, activityId: res.activityId });
          return { res, message: topic.recallPrompt ? undefined : 'Revision started' };
        }),
      pause: (id) => exec(async () => ({ res: await api.pause(id) })),
      resume: (activity) => guarded(activity.topicId, async () => ({ res: await api.resume(activity.id) })),
      end: (activity) => {
        if (activity.type === 'REVISION') {
          setModal({ mode: 'grade', topicId: activity.topicId, activityId: activity.id });
          return;
        }
        exec(async () => ({ res: await api.end(activity.id), message: 'Topic completed. First revision is due tomorrow.' }));
      },
      openRecall: (topicId) => setModal({ mode: 'recall', topicId }),
      cancelRevision: (id) => {
        setModal(null);
        exec(async () => ({ res: await api.cancelRevision(id), message: 'Revision discarded. Nothing was recorded.' }));
      },
    };
  }, [exec, run.isPending, gradeMutation.isPending, pausedFocus]);

  const answerFocus = (alsoFocus: boolean) => {
    focusAsk?.run(alsoFocus);
    setFocusAsk(null);
  };

  return (
    <Ctx.Provider value={actions}>
      {children}
      {focusAsk && (
        <Modal
          open
          onClose={() => setFocusAsk(null)}
          title="Resume the focus timer too?"
          footer={
            <>
              <Button onClick={() => answerFocus(false)}>Only the topic</Button>
              <Button variant="primary" onClick={() => answerFocus(true)}>
                ▶ Resume both
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-700">
            <strong>{focusAsk.focus.topicName}</strong> has a linked {focusAsk.focus.kind === 'BREAK' ? 'break' : 'focus'} countdown that is paused
            with <strong className="font-mono">{fmtCountdown(focusRemaining(focusAsk.focus, Date.now()))}</strong> left. Resume it together with the
            topic's study timer?
          </p>
        </Modal>
      )}
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
          onCancel={(activityId) => actions.cancelRevision(activityId)}
          grading={gradeMutation.isPending}
        />
      )}
    </Ctx.Provider>
  );
}
